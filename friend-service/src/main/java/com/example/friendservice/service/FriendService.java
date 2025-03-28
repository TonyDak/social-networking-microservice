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
    private final FriendCacheService cacheService;
    private final KafkaTemplate<String, FriendEvent> kafkaTemplate;

    @Value("${kafka.topic.friend-accepted}")
    private String friendAcceptedTopic;

    @Autowired
    public FriendService(FriendRepository friendRepository,
                         FriendRequestRepository friendRequestRepository,
                         FriendCacheService cacheService,
                         KafkaTemplate<String, FriendEvent> kafkaTemplate) {
        this.friendRepository = friendRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.cacheService = cacheService;
        this.kafkaTemplate = kafkaTemplate;
    }

    @Transactional(readOnly = true)
    public List<Friend> getFriends(String userId, int page, int size) {
        // Try to get from cache first
        List<Friend> cachedFriends = cacheService.getFriendList(userId);
        if (cachedFriends != null) {
            log.info("Retrieved friends for user {} from cache", userId);
            return cachedFriends;
        }

        // Get from database with pagination
        List<Friend> friends = friendRepository.findFriendsPaginated(userId, size, page * size);

        // Cache the result
        if (page == 0) {
            cacheService.cacheFriendList(userId, friends);
        }

        return friends;
    }

    @Transactional
    public Friend addFriend(Friend friend) {
        // Check if already friends
        if (friendRepository.existsByUserIdAndFriendId(friend.getUserId(), friend.getFriendId())) {
            throw new BadRequestException("Already friends");
        }

        Friend savedFriend = friendRepository.save(friend);

        // Invalidate cache
        cacheService.invalidateCache(friend.getUserId());

        return savedFriend;
    }

    @Transactional
    public void removeFriend(String userId, String friendId) {
        Friend friend = friendRepository.findByUserIdAndFriendId(userId, friendId)
                .orElseThrow(() -> new BadRequestException("Friend relationship not found"));

        friendRepository.delete(friend);

        // Remove reciprocal relationship
        friendRepository.findByUserIdAndFriendId(friendId, userId)
                .ifPresent(friendRepository::delete);

        // Invalidate cache for both users
        cacheService.invalidateCache(userId);
        cacheService.invalidateCache(friendId);
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

        // Invalidate cache for both users
        cacheService.invalidateCache(request.getSenderId());
        cacheService.invalidateCache(request.getReceiverId());

        // Send event to Kafka
        FriendEvent event = new FriendEvent();
        event.setType("FRIEND_ACCEPTED");
        event.setSenderId(request.getSenderId());
        event.setReceiverId(request.getReceiverId());
        event.setTimestamp(LocalDateTime.now());

        kafkaTemplate.send(friendAcceptedTopic, event);
    }
    // Thêm vào class FriendService
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
}