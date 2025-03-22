package com.example.authservice.service;

import com.example.authservice.dto.ForgotPasswordRequestDTO;
import com.example.authservice.dto.RegisterRequestDTO;
import com.example.authservice.dto.UserEventDTO;
import com.example.authservice.exception.KeycloakException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.KeycloakBuilder;
import org.keycloak.admin.client.resource.UsersResource;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Collections;
import jakarta.ws.rs.core.Response;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class KeycloakService {

    @Value("${keycloak.auth-server-url}")
    private String serverUrl;

    @Value("${keycloak.realm}")
    private String realm;

    @Value("${keycloak.resource}")
    private String clientId;

    @Value("${keycloak.credentials.secret}")
    private String clientSecret;

    @Value("${keycloak.admin.username}")
    private String adminUsername;

    @Value("${keycloak.admin.password}")
    private String adminPassword;

    @Value("${keycloak.admin.clientId}")
    private String adminClientId;

    public Keycloak getKeycloakInstance() {
        try {
            return KeycloakBuilder.builder()
                    .serverUrl(serverUrl)
                    .realm("master")
                    .username(adminUsername)
                    .password(adminPassword)
                    .clientId(adminClientId)
                    .build();
        } catch (Exception e) {
            log.error("Không thể kết nối đến máy chủ Keycloak: {}", e.getMessage());
            throw new KeycloakException("Không thể kết nối đến hệ thống xác thực", e);
        }
    }

    public Response createUser(RegisterRequestDTO request) {
        Keycloak keycloak = null;
        try {
            CredentialRepresentation credential = new CredentialRepresentation();
            credential.setType(CredentialRepresentation.PASSWORD);
            credential.setValue(request.getPassword());
            credential.setTemporary(false);
            //check if user already exists
            if (getUsers().stream().anyMatch(user -> user.getUsername().equals(request.getUsername()))) {
                return Response.status(Response.Status.CONFLICT)
                        .entity("Người dùng đã tồn tại")
                        .build();
            }
            //email
            if (getUsers().stream().anyMatch(user -> user.getEmail().equals(request.getEmail()))) {
                return Response.status(Response.Status.CONFLICT)
                        .entity("Email đã tồn tại")
                        .build();
            }
            UserRepresentation user = new UserRepresentation();
            user.setUsername(request.getUsername());
            user.setEmail(request.getEmail());
            user.setFirstName(request.getFirstName());
            user.setLastName(request.getLastName());
            user.setEnabled(true);
            user.setCredentials(Collections.singletonList(credential));

            keycloak = getKeycloakInstance();
            UsersResource usersResource = keycloak.realm(realm).users();
            Response response = usersResource.create(user);
            return response;
        } catch (Exception e) {
            log.error("Không thể tạo người dùng {}: {}", request.getUsername(), e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("Không thể tạo tài khoản: " + e.getMessage())
                    .build();
        } finally {
            if (keycloak != null) {
                keycloak.close();
            }
        }
    }

    public List<UserRepresentation> getUsers() {
        Keycloak keycloak = null;
        try {
            keycloak = getKeycloakInstance();
            return keycloak.realm(realm).users().list();
        } catch (Exception e) {
            log.error("Không thể lấy danh sách người dùng: {}", e.getMessage());
            throw new KeycloakException("Không thể lấy danh sách người dùng: " + e.getMessage(), e);
        } finally {
            if (keycloak != null) {
                keycloak.close();
            }
        }
    }

    public Response updatePassword(ForgotPasswordRequestDTO request) {
        if (request.getEmail() == null || request.getEmail().isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity("Email không được để trống")
                    .build();
        }

        Keycloak keycloak = null;
        String email = request.getEmail();

        try {
            log.info("Bắt đầu quá trình đặt lại mật khẩu cho email: {}", email);
            keycloak = getKeycloakInstance();
            UsersResource usersResource = keycloak.realm(realm).users();

            // Tìm kiếm người dùng bằng email
            List<UserRepresentation> users = usersResource.search(null, null, null, email, 0, 10);

            if (users.isEmpty()) {
                log.warn("Không tìm thấy người dùng với email: {}", email);
                return Response.status(Response.Status.NOT_FOUND)
                        .entity("Không tìm thấy người dùng với email: " + email)
                        .build();
            }

            // Tìm người dùng với email chính xác
            UserRepresentation matchedUser = null;
            for (UserRepresentation user : users) {
                if (email.equalsIgnoreCase(user.getEmail())) {
                    matchedUser = user;
                    break;
                }
            }

            if (matchedUser == null) {
                log.warn("Không tìm thấy người dùng với email chính xác: {}", email);
                return Response.status(Response.Status.NOT_FOUND)
                        .entity("Không tìm thấy người dùng với email chính xác: " + email)
                        .build();
            }

            log.info("Tìm thấy người dùng {} với ID: {}", email, matchedUser.getId());

            // Cấu hình tham số gửi email đặt lại mật khẩu
            String clientId = this.clientId;
            int lifespan = 900;  // Thời gian hiệu lực của liên kết (giây): 15 phút

            try {
                // Gửi email đặt lại mật khẩu với đúng tham số
                usersResource.get(matchedUser.getId()).executeActionsEmail(
                        clientId,          // client ID
                        null,              // redirect URI (sử dụng mặc định)
                        lifespan,          // thời gian hiệu lực (giây)
                        List.of("UPDATE_PASSWORD")  // hành động yêu cầu
                );

                log.info("Đã gửi email đặt lại mật khẩu thành công cho: {}", email);
                return Response.ok().entity("Đã gửi email đặt lại mật khẩu thành công").build();
            } catch (Exception e) {
                log.error("Lỗi khi gửi email đặt lại mật khẩu: {}", e.getMessage(), e);
                return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                        .entity("Không thể gửi email đặt lại mật khẩu: " + e.getMessage())
                        .build();
            }
        } catch (Exception e) {
            log.error("Không thể xử lý yêu cầu đặt lại mật khẩu cho {}: {}", email, e.getMessage(), e);
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("Không thể xử lý yêu cầu đặt lại mật khẩu: " + e.getMessage())
                    .build();
        } finally {
            if (keycloak != null) {
                keycloak.close();
            }
        }
    }

    public Response updateUser(UserEventDTO userEvent) {
        Keycloak keycloak = null;
        try {
            keycloak = getKeycloakInstance();
            UsersResource usersResource = keycloak.realm(realm).users();
            List<UserRepresentation> users = usersResource.list();
            boolean userFound = false;

            for (UserRepresentation user : users) {
                if (user.getUsername().equals(userEvent.getUsername())) {
                    user.setEmail(userEvent.getEmail());
                    user.setFirstName(userEvent.getFirstName());
                    user.setLastName(userEvent.getLastName());
                    usersResource.get(user.getId()).update(user);
                    return Response.ok().entity("Cập nhật thông tin người dùng thành công").build();
                }
            }

            if (!userFound) {
                return Response.status(Response.Status.NOT_FOUND)
                        .entity("Không tìm thấy người dùng: " + userEvent.getEmail())
                        .build();
            }

            return Response.ok().build();
        } catch (Exception e) {
            log.error("Không thể cập nhật người dùng {}: {}", userEvent.getEmail(), e.getMessage());
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity("Không thể cập nhật người dùng: " + e.getMessage())
                    .build();
        } finally {
            if (keycloak != null) {
                keycloak.close();
            }
        }
    }
}