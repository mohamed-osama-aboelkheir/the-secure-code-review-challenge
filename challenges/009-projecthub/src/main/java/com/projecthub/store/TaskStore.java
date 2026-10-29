package com.projecthub.store;

import com.projecthub.model.Task;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.springframework.data.mongodb.core.query.Criteria.where;

@Component
public class TaskStore {

    private final MongoTemplate mongo;

    public TaskStore(MongoTemplate mongo) {
        this.mongo = mongo;
    }

    public Task findById(String taskId) {
        if (taskId == null || !ObjectId.isValid(taskId)) {
            return null;
        }
        return mongo.findById(taskId, Task.class);
    }

    public List<Task> findAllForProject(String projectId) {
        return mongo.find(Query.query(where("projectId").is(projectId)), Task.class);
    }

    public Task create(Task task) {
        return mongo.insert(task);
    }

    public void update(String taskId, Map<String, Object> fields) {
        Update update = new Update().set("updatedAt", Instant.now());
        fields.forEach(update::set);
        mongo.updateFirst(byId(taskId), update, Task.class);
    }

    public void delete(String taskId) {
        mongo.remove(byId(taskId), Task.class);
    }

    private Query byId(String taskId) {
        return Query.query(where("_id").is(new ObjectId(taskId)));
    }
}
