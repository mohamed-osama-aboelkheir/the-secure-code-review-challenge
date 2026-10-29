<#macro page title active="">
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} · ProjectHub</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='6' fill='%235b5bd6'/%3E%3Cg fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round'%3E%3Cpath d='M8 7v7M12 7v4M16 7v9'/%3E%3C/g%3E%3C/svg%3E">
  <link rel="stylesheet" href="/css/app.css">
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="logo" href="/projects"><span class="logo-mark"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 7v7"/><path d="M12 7v4"/><path d="M16 7v9"/></svg></span> ProjectHub</a>
      <#if currentUser??>
      <nav class="nav-links">
        <a href="/projects"<#if active == "projects"> class="active"</#if>>Projects</a>
        <a href="/invitations"<#if active == "invitations"> class="active"</#if>>Invitations</a>
      </nav>
      <div class="nav-user">
        <@avatar name=currentUser.username/>
        <span class="username">${currentUser.username}</span>
        <form method="post" action="/logout">
          <@csrfField/>
          <button class="btn-ghost btn-sm" type="submit">Logout</button>
        </form>
      </div>
      <#else>
      <div class="nav-user">
        <a href="/login">Log in</a>
        <a class="btn btn-sm" href="/register">Sign up</a>
      </div>
      </#if>
    </div>
  </header>
  <main>
    <#nested>
  </main>
</body>
</html>
</#macro>

<#macro csrfField>
<input type="hidden" name="${csrf.parameterName}" value="${csrf.token}">
</#macro>

<#macro alert>
<#if error??><div class="alert alert-error">${error}</div></#if>
</#macro>

<#macro avatar name size="">
<#assign initial = name[0..0]?upper_case>
<span class="avatar avatar-c${"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"?index_of(initial) % 6 + 1}<#if size?has_content> avatar-${size}</#if>" title="${name}">${initial}</span>
</#macro>

<#macro badge value>
<span class="badge badge-${value}">${label(value)}</span>
</#macro>

<#function label value>
<#return {"todo": "To do", "in_progress": "In progress", "on_hold": "On hold"}[value]!value?cap_first>
</#function>
