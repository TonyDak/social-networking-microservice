package com.example.authservice.service;

import lombok.RequiredArgsConstructor;
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
        return KeycloakBuilder.builder()
            .serverUrl(serverUrl)
            .realm("master")
            .username(adminUsername)
            .password(adminPassword)
            .clientId(adminClientId)
            .build();
    }

    public Response createUser(String username, String email, String firstName, String lastName, String password) {
        CredentialRepresentation credential = new CredentialRepresentation();
        credential.setType(CredentialRepresentation.PASSWORD);
        credential.setValue(password);
        credential.setTemporary(false);

        UserRepresentation user = new UserRepresentation();
        user.setUsername(username);
        user.setEmail(email);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setEnabled(true);
        user.setCredentials(Collections.singletonList(credential));

        Keycloak keycloak = getKeycloakInstance();
        UsersResource usersResource = keycloak.realm(realm).users();
        Response response = usersResource.create(user);
        keycloak.close();

        return response;
    }

    public List<UserRepresentation> getUsers() {
        Keycloak keycloak = getKeycloakInstance();
        List<UserRepresentation> users = keycloak.realm(realm).users().list();
        keycloak.close();
        return users;
    }
}