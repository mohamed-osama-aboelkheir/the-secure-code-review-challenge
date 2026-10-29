<#import "layout.ftlh" as layout>
<@layout.page title="Sign up">
<div class="auth">
  <div class="card">
    <h1>Create your account</h1>
    <p class="subtitle">Start a project and invite your team.</p>
    <@layout.alert/>
    <form method="post" action="/register">
      <@layout.csrfField/>
      <label>Username <input type="text" name="username" value="${username!}" required minlength="3" maxlength="32" autofocus></label>
      <label>Password <input type="password" name="password" required minlength="8"></label>
      <button type="submit">Create account</button>
    </form>
  </div>
  <p class="switch">Already have an account? <a href="/login">Log in</a></p>
</div>
</@layout.page>
