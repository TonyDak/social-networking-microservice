package com.example.friendservice.service;


import com.example.friendservice.model.Friend;
import com.example.friendservice.repository.FriendRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class FriendAnalyticsService {
    private final FriendRepository friendRepository;
    private final FriendCacheService cacheService;

    @Autowired
    public FriendAnalyticsService(FriendRepository friendRepository,
                                  FriendCacheService cacheService) {
        this.friendRepository = friendRepository;
        this.cacheService = cacheService;
    }

    // Tìm bạn chung
    public List<String> getMutualFriends(String userId1, String userId2) {
        List<Friend> friends1 = friendRepository.findByUserId(userId1);
        List<Friend> friends2 = friendRepository.findByUserId(userId2);

        Set<String> friendIds1 = friends1.stream()
                .map(Friend::getFriendId)
                .collect(Collectors.toSet());

        List<String> mutualFriends = friends2.stream()
                .map(Friend::getFriendId)
                .filter(friendIds1::contains)
                .collect(Collectors.toList());

        // Cache kết quả
        cacheService.cacheMutualFriends(userId1, userId2, mutualFriends);

        return mutualFriends;
    }

    // Đề xuất bạn bè dựa trên bạn chung
    public List<String> getFriendSuggestions(String userId, int limit) {
        List<Friend> userFriends = friendRepository.findByUserId(userId);
        Set<String> existingFriendIds = userFriends.stream()
                .map(Friend::getFriendId)
                .collect(Collectors.toSet());

        Map<String, Integer> suggestedFriends = new HashMap<>();

        // Duyệt qua từng người bạn hiện tại
        for (Friend friend : userFriends) {
            // Lấy danh sách bạn của bạn
            List<Friend> friendsOfFriend = friendRepository.findByUserId(friend.getFriendId());

            for (Friend fof : friendsOfFriend) {
                String potentialFriendId = fof.getFriendId();

                // Bỏ qua nếu đã là bạn hoặc chính là user
                if (existingFriendIds.contains(potentialFriendId) ||
                        potentialFriendId.equals(userId)) {
                    continue;
                }

                // Tăng điểm cho mỗi bạn chung
                suggestedFriends.put(potentialFriendId,
                        suggestedFriends.getOrDefault(potentialFriendId, 0) + 1);
            }
        }

        // Sắp xếp theo số bạn chung và lấy top N
        return suggestedFriends.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(limit)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }
}
