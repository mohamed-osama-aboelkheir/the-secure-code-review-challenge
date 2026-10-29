package com.projecthub.store;

import com.projecthub.model.Invitation;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

import static org.springframework.data.mongodb.core.query.Criteria.where;

@Component
public class InvitationStore {

    private final MongoTemplate mongo;

    public InvitationStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    public Invitation findById(String invitationId) {
        if (invitationId == null || !ObjectId.isValid(invitationId)) {
            return null;
        }
        return mongo.findById(invitationId, Invitation.class);
    }

    public List<Invitation> findPendingForUser(String userId) {
        return mongo.find(Query.query(where("invitedUserId").is(userId).and("status").is("pending")), Invitation.class);
    }

    public Invitation findExisting(String projectId, String userId) {
        Query query = Query.query(where("projectId").is(projectId)
                .and("invitedUserId").is(userId)
                .and("status").is("pending"));
        return mongo.findOne(query, Invitation.class);
    }

    public Invitation create(Invitation invitation) {
        return mongo.insert(invitation);
    }

    public void updateStatus(String invitationId, String status) {
        Query query = Query.query(where("_id").is(new ObjectId(invitationId)));
        mongo.updateFirst(query, new Update().set("status", status).set("updatedAt", Instant.now()), Invitation.class);
    }
}
