package com.example.friendservice.repository;

import com.example.friendservice.model.FriendRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {
    List<FriendRequest> findByReceiverIdAndStatus(String receiverId, FriendRequest.RequestStatus status);
    List<FriendRequest> findBySenderIdAndStatus(String senderId, FriendRequest.RequestStatus status);

    @Query(value = "SELECT * FROM friend_requests WHERE receiver_id = :userId AND status = 'PENDING' " +
            "ORDER BY created_at DESC LIMIT :limit OFFSET :offset", nativeQuery = true)
    List<FriendRequest> findPendingRequestsPaginated(String userId, int limit, int offset);

    Optional<FriendRequest> findBySenderIdAndReceiverIdAndStatus(
            String senderId, String receiverId, FriendRequest.RequestStatus status);

    boolean existsBySenderIdAndReceiverIdAndStatus(
            String senderId, String receiverId, FriendRequest.RequestStatus status);

}