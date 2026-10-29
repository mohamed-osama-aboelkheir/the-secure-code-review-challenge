package com.projecthub.store;

import com.projecthub.model.Member;
import com.projecthub.model.Project;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.util.List;

import static org.springframework.data.mongodb.core.query.Criteria.where;

@Component
public class ProjectStore {

    public static final String DEFAULT_TEMPLATE =
            "Project: ${project.name}\nStatus: ${project.status}\nDescription: ${project.description}";

    private final MongoTemplate mongo;

    public ProjectStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    public Project findById(String projectId) {
        if (projectId == null || !ObjectId.isValid(projectId)) {
            return null;
        }
        return mongo.findById(projectId, Project.class);
    }

    public List<Project> findAllForUser(String userId) {
        return mongo.find(Query.query(where("members.userId").is(userId)), Project.class);
    }

    public Project create(String name, String description, String status, Member owner) {
        return mongo.insert(new Project(name, description, status, owner, DEFAULT_TEMPLATE));
    }

    public void addMember(String projectId, Member member) {
        mongo.updateFirst(byId(projectId), new Update().push("members", member), Project.class);
    }

    public void updateMemberRole(String projectId, String userId, String role) {
        Query query = Query.query(where("_id").is(new ObjectId(projectId)).and("members.userId").is(userId));
        mongo.updateFirst(query, new Update().set("members.$.role", role), Project.class);
    }

    public void removeMember(String projectId, String userId) {
        mongo.updateFirst(byId(projectId), new Update().pull("members", new Document("userId", userId)), Project.class);
    }

    public void updateTemplate(String projectId, String template) {
        mongo.updateFirst(byId(projectId), new Update().set("reportTemplate", template), Project.class);
    }

    private Query byId(String projectId) {
        return Query.query(where("_id").is(new ObjectId(projectId)));
    }
}
