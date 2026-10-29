package com.projecthub.auth;

import com.projecthub.model.Member;
import com.projecthub.model.Project;

public final class ProjectAccess {

    private ProjectAccess() {
    }

    public static boolean isMember(Project project, String userId) {
        return roleOf(project, userId) != null;
    }

    public static boolean isAdmin(Project project, String userId) {
        String role = roleOf(project, userId);
        return "owner".equals(role) || "admin".equals(role);
    }

    public static String roleOf(Project project, String userId) {
        for (Member member : project.getMembers()) {
            if (member.getUserId().equals(userId)) {
                return member.getRole();
            }
        }
        return null;
    }
}
