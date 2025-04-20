package com.example.friendservice.service;

import com.example.friendservice.dto.FriendEvent;
import com.example.friendservice.exception.BadRequestException;
import com.example.friendservice.model.Friend;
import com.example.friendservice.model.FriendRequest;
import com.example.friendservice.repository.FriendRepository;
import com.example.friendservice.repository.FriendRequestRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.Caching;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Slf4j
public class FriendService {
    private final FriendRepository friendRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final KafkaTemplate<String, FriendEvent> kafkaTemplate;

    @Value("${kafka.topic.friend-accepted}")
    private String friendAcceptedTopic;

    @Autowired
    public FriendService(FriendRepository friendRepository,
                         FriendRequestRepository friendRequestRepository,
                         KafkaTemplate<String, FriendEvent> kafkaTemplate) {
        this.friendRepository = friendRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.kafkaTemplate = kafkaTemplate;
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "friends", key = "'user_' + #userId + '_page_' + #page + '_size_' + #size")
    public List<Friend> getFriends(String userId, int page, int size) {
        log.info("Retrieving friends from database for user {}", userId);
        return friendRepository.findFriendsPaginated(userId, size, page * size);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "friends", key = "'user_' + #userId + '_page_' + #page + '_size_' + #size + '_sort_' + #sortBy + '_' + #sortDirection")
    public List<Friend> getFriends(String userId, int page, int size, String sortBy, String sortDirection) {
        log.info("Retrieving sorted friends from database for user {}", userId);
        Sort sort = Sort.by(sortDirection.equalsIgnoreCase("asc") ? Sort.Direction.ASC : Sort.Direction.DESC, sortBy);
        Pageable pageable = PageRequest.of(page, size, sort);
        return friendRepository.findFriendsByUserId(userId, pageable).getContent();
    }

    @Transactional
    @CacheEvict(value = "friends", allEntries = true)
    public void removeFriend(String userId, String friendId) {
        Friend friend = friendRepository.findByUserIdAndFriendId(userId, friendId)
                .orElseThrow(() -> new BadRequestException("Friend relationship not found"));

        friendRepository.delete(friend);

        // Remove reciprocal relationship
        friendRepository.findByUserIdAndFriendId(friendId, userId)
                .ifPresent(friendRepository::delete);
    }

    @Transactional
    public FriendRequest sendFriendRequest(FriendRequest request) {
        // Validate request
        if (request.getSenderId().equals(request.getReceiverId())) {
            throw new BadRequestException("Cannot send friend request to yourself");
        }

        // Check if already friends
        if (friendRepository.existsByUserIdAndFriendId(request.getSenderId(), request.getReceiverId())) {
            throw new BadRequestException("Already friends");
        }

        // Check if request already exists
        if (friendRequestRepository.existsBySenderIdAndReceiverIdAndStatus(
                request.getSenderId(), request.getReceiverId(), FriendRequest.RequestStatus.PENDING)) {
            throw new BadRequestException("Friend request already sent");
        }

        return friendRequestRepository.save(request);
    }

    @Transactional
    @Caching(evict = {
            @CacheEvict(value = "friends", allEntries = true)
    })
    public void acceptFriendRequest(Long requestId, String userId) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new BadRequestException("Friend request not found"));

        // Validate request
        if (!request.getReceiverId().equals(userId)) {
            throw new BadRequestException("Cannot accept this request");
        }

        if (!request.getStatus().equals(FriendRequest.RequestStatus.PENDING)) {
            throw new BadRequestException("Request is not pending");
        }

        // Update request status
        request.setStatus(FriendRequest.RequestStatus.ACCEPTED);
        friendRequestRepository.save(request);

        // Create bidirectional friend relationship
        Friend friend1 = new Friend();
        friend1.setUserId(request.getSenderId());
        friend1.setFriendId(request.getReceiverId());

        Friend friend2 = new Friend();
        friend2.setUserId(request.getReceiverId());
        friend2.setFriendId(request.getSenderId());

        friendRepository.save(friend1);
        friendRepository.save(friend2);

        // Send event to Kafka
        FriendEvent event = new FriendEvent();
        event.setType("FRIEND_ACCEPTED");
        event.setSenderId(request.getSenderId());
        event.setReceiverId(request.getReceiverId());
        event.setTimestamp(LocalDateTime.now());

        kafkaTemplate.send(friendAcceptedTopic, event);
    }

    @Transactional(readOnly = true)
    public List<FriendRequest> getPendingRequests(String userId, int page, int size) {
        return friendRequestRepository.findPendingRequestsPaginated(userId, size, page * size);
    }

    @Transactional
    public void rejectFriendRequest(Long requestId, String userId) {
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new BadRequestException("Friend request not found"));

        // Validate request
        if (!request.getReceiverId().equals(userId)) {
            throw new BadRequestException("Cannot reject this request");
        }

        if (!request.getStatus().equals(FriendRequest.RequestStatus.PENDING)) {
            throw new BadRequestException("Request is not pending");
        }

        // Update request status
        request.setStatus(FriendRequest.RequestStatus.REJECTED);
        friendRequestRepository.save(request);
    }

    //check if user is already friends
    public boolean areFriends(String userId, String friendId) {
        return friendRepository.existsByUserIdAndFriendId(userId, friendId);
    }
}