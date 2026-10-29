package com.projecthub.store;

import com.projecthub.model.User;
import org.bson.types.ObjectId;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Component;

import static org.springframework.data.mongodb.core.query.Criteria.where;

@Component
public class UserStore {

    private final MongoTemplate mongo;

    public UserStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    public User findById(String userId) {
        if (userId == null || !ObjectId.isValid(userId)) {
            return null;
        }
        return mongo.findById(userId, User.class);
    }

    public User findByUsername(String username) {
        return mongo.findOne(Query.query(where("username").is(username)), User.class);
    }

    public User create(String username, String passwordHash) {
        try {
            return mongo.insert(new User(username, passwordHash));
        } catch (DuplicateKeyException e) {
            return null;
        }
    }
}
