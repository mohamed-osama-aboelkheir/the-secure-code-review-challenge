<#import "layout.ftlh" as layout>
<@layout.page title="Invitations" active="invitations">
<div class="page-header">
  <div>
    <h1>Invitations</h1>
    <p>Projects you've been invited to join.</p>
  </div>
</div>
<@layout.alert/>
<section class="card">
  <#list invitations as inv>
  <div class="invite">
    <span class="logo-mark" style="color: #fff;">${inv.projectName[0..0]?upper_case}</span>
    <div class="invite-body">
      <strong>${inv.projectName}</strong>
      <span class="muted">Join as <@layout.badge value=inv.role/></span>
    </div>
    <form method="post" action="/invitations/${inv.id}/accept">
      <@layout.csrfField/>
      <button class="btn-sm" type="submit">Accept</button>
    </form>
    <form method="post" action="/invitations/${inv.id}/decline">
      <@layout.csrfField/>
      <button class="btn-secondary btn-sm" type="submit">Decline</button>
    </form>
  </div>
  <#else>
  <div class="empty">No pending invitations.</div>
  </#list>
</section>
</@layout.page>
