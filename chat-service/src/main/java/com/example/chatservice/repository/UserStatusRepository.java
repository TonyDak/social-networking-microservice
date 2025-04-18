package com.example.chatservice.repository;

import com.example.chatservice.model.UserStatus;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserStatusRepository extends CrudRepository<UserStatus, String> {
}