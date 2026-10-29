<#import "layout.ftlh" as layout>
<@layout.page title="Log in">
<div class="auth">
  <div class="card">
    <h1>Welcome back</h1>
    <p class="subtitle">Log in to pick up where your team left off.</p>
    <#if registered!false><div class="alert alert-success">Account created. You can log in now.</div></#if>
    <@layout.alert/>
    <form method="post" action="/login">
      <@layout.csrfField/>
      <label>Username <input type="text" name="username" value="${username!}" required autofocus></label>
      <label>Password <input type="password" name="password" required></label>
      <button type="submit">Log in</button>
    </form>
  </div>
  <p class="switch">New to ProjectHub? <a href="/register">Create an account</a></p>
</div>
</@layout.page>
