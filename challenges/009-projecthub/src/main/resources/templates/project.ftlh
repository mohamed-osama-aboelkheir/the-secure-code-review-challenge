<#import "layout.ftlh" as layout>
<@layout.page title=project.name active="projects">
<div class="page-header">
  <div>
    <div class="breadcrumb"><a href="/projects">Projects</a> / ${project.name}</div>
    <h1>${project.name} <@layout.badge value=project.status/></h1>
    <#if project.description?has_content><p>${project.description}</p></#if>
  </div>
  <div class="avatars">
    <#list project.members as m><@layout.avatar name=(m.username!m.userId)/></#list>
  </div>
</div>
<@layout.alert/>

<div class="layout-split">
  <div>
    <div class="board">
      <#list taskStatuses as s>
      <#assign columnTasks = tasks?filter(t -> t.status == s)>
      <div class="column">
        <div class="column-header"><span>${layout.label(s)}</span><span class="count">${columnTasks?size}</span></div>
        <#list columnTasks as task>
        <details class="task">
          <summary>
            <div class="task-title">${task.title}</div>
            <#if task.description?has_content><div class="task-desc">${task.description}</div></#if>
            <div class="task-meta">
              <#if task.assignedTo?? && memberNames[task.assignedTo]??>
              <@layout.avatar name=memberNames[task.assignedTo] size="sm"/> ${memberNames[task.assignedTo]}
              <#else>
              Unassigned
              </#if>
            </div>
          </summary>
          <div class="task-edit">
            <form method="post" action="/projects/${project.id}/tasks/${task.id}">
              <@layout.csrfField/>
              <label>Title <input type="text" name="title" value="${task.title}" required></label>
              <label>Description <textarea name="description" rows="2">${task.description!}</textarea></label>
              <label>Status
                <select name="status">
                  <#list taskStatuses as ts><option value="${ts}"<#if ts == task.status> selected</#if>>${layout.label(ts)}</option></#list>
                </select>
              </label>
              <label>Assignee
                <select name="assigned_to">
                  <option value="">Unassigned</option>
                  <#list memberNames as userId, name><option value="${userId}"<#if userId == (task.assignedTo!"")> selected</#if>>${name!userId}</option></#list>
                </select>
              </label>
              <div class="form-actions">
                <button class="btn-sm" type="submit">Save task</button>
                <button class="btn-danger btn-sm" type="submit" formaction="/projects/${project.id}/tasks/${task.id}/delete">Delete task</button>
              </div>
            </form>
          </div>
        </details>
        <#else>
        <div class="empty">No tasks</div>
        </#list>
      </div>
      </#list>
    </div>
    <#if !tasks?has_content><p class="muted">No tasks yet. Add the first one below.</p></#if>

    <section class="card">
      <h2>New task</h2>
      <form method="post" action="/projects/${project.id}/tasks">
        <@layout.csrfField/>
        <label>Title <input type="text" name="title" required></label>
        <label>Description <textarea name="description" rows="2"></textarea></label>
        <div class="form-row">
          <label>Status
            <select name="status">
              <#list taskStatuses as s><option value="${s}">${layout.label(s)}</option></#list>
            </select>
          </label>
          <label>Assignee
            <select name="assigned_to">
              <option value="">Unassigned</option>
              <#list memberNames as userId, name><option value="${userId}">${name!userId}</option></#list>
            </select>
          </label>
        </div>
        <button type="submit">Add task</button>
      </form>
    </section>
  </div>

  <aside>
    <section class="card">
      <h2>Members</h2>
      <#list project.members as m>
      <div class="member">
        <@layout.avatar name=(m.username!m.userId)/>
        <span class="member-name">${m.username!m.userId}</span>
        <@layout.badge value=m.role/>
        <#if canManage && m.role != "owner">
        <div class="member-actions">
          <form class="inline" method="post" action="/projects/${project.id}/members/${m.userId}/role">
            <@layout.csrfField/>
            <select name="role">
              <#list memberRoles as r><option value="${r}"<#if r == m.role> selected</#if>>${r?cap_first}</option></#list>
            </select>
            <button class="btn-secondary btn-sm" type="submit">Change role</button>
          </form>
          <form class="inline" method="post" action="/projects/${project.id}/members/${m.userId}/remove">
            <@layout.csrfField/>
            <button class="btn-danger btn-sm" type="submit">Remove</button>
          </form>
        </div>
        </#if>
      </div>
      </#list>

      <#if canManage>
      <h3>Invite a member</h3>
      <form method="post" action="/projects/${project.id}/members">
        <@layout.csrfField/>
        <label>Username <input type="text" name="username" required></label>
        <label>Role
          <select name="role">
            <#list memberRoles as r><option value="${r}">${r?cap_first}</option></#list>
          </select>
        </label>
        <button type="submit">Send invitation</button>
      </form>
      </#if>
    </section>
  </aside>
</div>

  <section class="card">
    <h2>Status report</h2>
    <form method="post" action="/projects/${project.id}/report">
      <@layout.csrfField/>
      <label>Report template
        <textarea class="code" name="template" rows="5">${templateDraft!}</textarea>
      </label>
      <p class="hint">Fields: <code>${r"${project.name}"}</code> <code>${r"${project.status}"}</code> <code>${r"${project.description}"}</code></p>
      <div class="form-actions">
        <button type="submit">Generate report</button>
        <button class="btn-secondary" type="submit" formaction="/projects/${project.id}/template">Save as project template</button>
      </div>
    </form>
    <#if report??>
    <h3>Report</h3>
    <pre class="report">${report}</pre>
    </#if>
  </section>
</@layout.page>
