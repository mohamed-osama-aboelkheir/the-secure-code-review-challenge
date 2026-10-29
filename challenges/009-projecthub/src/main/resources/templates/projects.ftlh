<#import "layout.ftlh" as layout>
<@layout.page title="Projects" active="projects">
<div class="page-header">
  <div>
    <h1>Projects</h1>
    <p>Everything your teams are working on.</p>
  </div>
</div>
<@layout.alert/>

<#if projects?has_content>
<div class="project-grid">
  <#list projects as p>
  <a class="project-card" href="/projects/${p.id}">
    <div class="project-card-top">
      <h3>${p.name}</h3>
      <@layout.badge value=p.status/>
    </div>
    <p><#if p.description?has_content>${p.description}<#else>No description</#if></p>
    <div class="project-card-footer">
      <div class="avatars">
        <#list p.members as m><#if m?index lt 5><@layout.avatar name=(m.username!m.userId) size="sm"/></#if></#list>
      </div>
      <span>${p.members?size} member<#if p.members?size != 1>s</#if></span>
    </div>
  </a>
  </#list>
</div>
<#else>
<div class="card empty">You're not on any projects yet. Create one below, or check your <a href="/invitations">invitations</a>.</div>
</#if>

<section class="card" style="max-width: 640px;">
  <h2>New project</h2>
  <form method="post" action="/projects">
    <@layout.csrfField/>
    <label>Name <input type="text" name="name" required></label>
    <label>Description <textarea name="description" rows="3"></textarea></label>
    <label>Status
      <select name="status">
        <#list projectStatuses as s><option value="${s}">${layout.label(s)}</option></#list>
      </select>
    </label>
    <button type="submit">Create project</button>
  </form>
</section>
</@layout.page>
