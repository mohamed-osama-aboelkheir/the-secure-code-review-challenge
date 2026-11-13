using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Ticketee.Data;

namespace Ticketee.Auth;

public static class AuthSetup
{
    public const string DefaultScheme = "Ticketee";
    public const string CookieName = "ticketee_session";
    public const string DisplayNameClaim = "ticketee:name";

    public static bool IsApiRequest(HttpRequest request) => request.Path.StartsWithSegments("/api");

    public static void AddTicketeeAuth(this IServiceCollection services)
    {
        services
            .AddIdentityCore<User>(o =>
            {
                o.User.RequireUniqueEmail = true;
                o.Password.RequiredLength = 8;
                o.Password.RequireDigit = false;
                o.Password.RequireLowercase = false;
                o.Password.RequireUppercase = false;
                o.Password.RequireNonAlphanumeric = false;
                o.Lockout.AllowedForNewUsers = true;
                o.Lockout.MaxFailedAccessAttempts = 5;
                o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
                o.SignIn.RequireConfirmedAccount = false;
            })
            .AddEntityFrameworkStores<TicketeeDbContext>()
            .AddSignInManager()
            .AddClaimsPrincipalFactory<TicketeeClaimsPrincipalFactory>();

        services
            .AddAuthentication(o =>
            {
                o.DefaultScheme = DefaultScheme;
                o.DefaultChallengeScheme = DefaultScheme;
            })
            .AddPolicyScheme(DefaultScheme, "Cookie for pages, bearer token for the API", o =>
                o.ForwardDefaultSelector = context => IsApiRequest(context.Request)
                    ? IdentityConstants.BearerScheme
                    : IdentityConstants.ApplicationScheme)
            .AddBearerToken(IdentityConstants.BearerScheme, o =>
                o.BearerTokenExpiration = TimeSpan.FromHours(1))
            .AddIdentityCookies();

        services.ConfigureApplicationCookie(o =>
        {
            o.Cookie.Name = CookieName;
            o.Cookie.HttpOnly = true;
            o.Cookie.SameSite = SameSiteMode.Lax;
            o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
            o.LoginPath = "/login";
            o.LogoutPath = "/logout";
            o.AccessDeniedPath = "/status/403";
            o.ExpireTimeSpan = TimeSpan.FromHours(8);
            o.SlidingExpiration = true;
        });

        services.Configure<SecurityStampValidatorOptions>(o => o.ValidationInterval = TimeSpan.Zero);

        services.AddScoped<ApiTokenIssuer>();
    }

    public static IApplicationBuilder UseApiSecurityStampValidation(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            if (IsApiRequest(context.Request) && context.User.Identity?.IsAuthenticated == true)
            {
                var signIn = context.RequestServices.GetRequiredService<SignInManager<User>>();
                if (await signIn.ValidateSecurityStampAsync(context.User) is null)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(new { error = "Session is no longer valid" });
                    return;
                }
            }
            await next();
        });
}

public class TicketeeClaimsPrincipalFactory : UserClaimsPrincipalFactory<User>
{
    public TicketeeClaimsPrincipalFactory(UserManager<User> users, IOptions<IdentityOptions> options)
        : base(users, options) { }

    protected override async Task<ClaimsIdentity> GenerateClaimsAsync(User user)
    {
        var identity = await base.GenerateClaimsAsync(user);
        identity.AddClaim(new Claim(AuthSetup.DisplayNameClaim, user.Name));
        return identity;
    }
}

public class ApiTokenIssuer
{
    private readonly SignInManager<User> _signIn;
    private readonly IOptionsMonitor<BearerTokenOptions> _options;

    public ApiTokenIssuer(SignInManager<User> signIn, IOptionsMonitor<BearerTokenOptions> options)
    {
        _signIn = signIn;
        _options = options;
    }

    public async Task<string> IssueAsync(User user)
    {
        var options = _options.Get(IdentityConstants.BearerScheme);
        var principal = await _signIn.CreateUserPrincipalAsync(user);
        var now = DateTimeOffset.UtcNow;
        var properties = new AuthenticationProperties
        {
            IssuedUtc = now,
            ExpiresUtc = now.Add(options.BearerTokenExpiration),
        };
        var ticket = new AuthenticationTicket(principal, properties, IdentityConstants.BearerScheme);
        return options.BearerTokenProtector.Protect(ticket);
    }
}

public static class ClaimsPrincipalExtensions
{
    public static int GetUserId(this ClaimsPrincipal principal) =>
        int.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? throw new InvalidOperationException("Missing user id claim"));

    public static string GetDisplayName(this ClaimsPrincipal principal) =>
        principal.FindFirstValue(AuthSetup.DisplayNameClaim) ?? "";

    public static string GetEmail(this ClaimsPrincipal principal) =>
        principal.FindFirstValue(ClaimTypes.Email) ?? "";
}
