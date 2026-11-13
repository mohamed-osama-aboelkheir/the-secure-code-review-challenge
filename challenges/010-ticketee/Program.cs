using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Ticketee.Auth;
using Ticketee.Data;
using Ticketee.Services;
using Ticketee.Stores;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings__Default is not configured");

builder.Services.AddDbContext<TicketeeDbContext>(o => o.UseNpgsql(connectionString));

builder.Services.AddSingleton<MarkdownRenderer>();
builder.Services.AddScoped<ProjectStore>();
builder.Services.AddScoped<InvitationStore>();
builder.Services.AddScoped<IssueStore>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<ProjectService>();
builder.Services.AddScoped<IssueService>();

builder.Services.AddDataProtection()
    .SetApplicationName("Ticketee")
    .PersistKeysToFileSystem(new DirectoryInfo(
        builder.Configuration["DATA_PROTECTION_KEYS_PATH"] ?? Path.Combine(AppContext.BaseDirectory, "keys")));

builder.Services.AddTicketeeAuth();
builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("auth", context => HttpMethods.IsGet(context.Request.Method)
        ? RateLimitPartition.GetNoLimiter("read")
        : RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.AddControllers();
builder.Services.AddRazorPages(o =>
{
    o.Conventions.AuthorizeFolder("/Projects");
    o.Conventions.AuthorizePage("/Invitations");
});
builder.Services.AddAntiforgery(o =>
{
    o.Cookie.Name = "ticketee_csrf";
    o.Cookie.SameSite = SameSiteMode.Strict;
});

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TicketeeDbContext>();
    for (var attempt = 1; ; attempt++)
    {
        try
        {
            await db.Database.EnsureCreatedAsync();
            app.Logger.LogInformation("Database initialized");
            break;
        }
        catch (Exception ex) when (attempt < 30)
        {
            app.Logger.LogWarning("Database not ready ({Message}), retrying...", ex.Message);
            await Task.Delay(TimeSpan.FromSeconds(2));
        }
    }
}

app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
{
    if (AuthSetup.IsApiRequest(context.Request))
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await context.Response.WriteAsJsonAsync(new { error = "Internal server error" });
        return;
    }
    context.Response.Redirect("/status/500");
}));

app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["Content-Security-Policy"] =
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; " +
        "object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "same-origin";
    await next();
});

app.UseWhen(c => !AuthSetup.IsApiRequest(c.Request),
    branch => branch.UseStatusCodePagesWithReExecute("/status/{0}"));

app.UseStaticFiles();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseApiSecurityStampValidation();
app.UseAuthorization();

app.MapControllers();
app.MapRazorPages();

app.Run();
