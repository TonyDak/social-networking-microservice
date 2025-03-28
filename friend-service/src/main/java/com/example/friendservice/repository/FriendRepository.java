package com.example.friendservice.repository;

import com.example.friendservice.model.Friend;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface FriendRepository extends JpaRepository<Friend, Long> {
    List<Friend> findByUserId(String userId);

    Optional<Friend> findByUserIdAndFriendId(String userId, String friendId);

    boolean existsByUserIdAndFriendId(String userId, String friendId);

    @Query(value = "SELECT * FROM friends WHERE user_id = :userId LIMIT :limit OFFSET :offset",
            nativeQuery = true)
    List<Friend> findFriendsPaginated(String userId, int limit, int offset);

    @Query("SELECT f FROM Friend f WHERE f.userId = :userId ORDER BY f.favorite DESC, f.createdAt DESC")
    List<Friend> findFriendsSorted(String userId);
}