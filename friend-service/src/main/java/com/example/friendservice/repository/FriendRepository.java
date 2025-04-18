package com.example.friendservice.repository;

import com.example.friendservice.model.Friend;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface FriendRepository extends JpaRepository<Friend, Long> {
    List<Friend> findByUserId(String userId);

    Page<Friend> findFriendsByUserId(String userId, Pageable pageable);

    Optional<Friend> findByUserIdAndFriendId(String userId, String friendId);

    boolean existsByUserIdAndFriendId(String userId, String friendId);

    @Query(value = "SELECT * FROM friends WHERE user_id = :userId LIMIT :limit OFFSET :offset",
            nativeQuery = true)
    List<Friend> findFriendsPaginated(String userId, int limit, int offset);

    @Query("SELECT f FROM Friend f WHERE f.userId = :userId ORDER BY f.favorite DESC, f.createdAt DESC")
    List<Friend> findFriendsSorted(String userId);

    @Query(value = "SELECT f1.friend_id FROM friends f1 " +
            "JOIN friends f2 ON f1.friend_id = f2.friend_id " +
            "WHERE f1.user_id = :userId1 AND f2.user_id = :userId2",
            nativeQuery = true)
    List<String> findMutualFriends(String userId1, String userId2);

    @Query(value = "SELECT f2.user_id FROM friends f1 " +
            "JOIN friends f2 ON f1.friend_id = f2.friend_id " +
            "WHERE f1.user_id = :userId AND f2.user_id != :userId " +
            "AND NOT EXISTS (SELECT 1 FROM friends f3 WHERE f3.user_id = :userId AND f3.friend_id = f2.user_id) " +
            "GROUP BY f2.user_id " +
            "ORDER BY COUNT(*) DESC " +
            "LIMIT :limit",
            nativeQuery = true)
    List<String> findFriendSuggestions(String userId, int limit);
}