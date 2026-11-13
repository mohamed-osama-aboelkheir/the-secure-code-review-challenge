using Microsoft.AspNetCore.Mvc.RazorPages;

namespace Ticketee.Pages;

public class StatusModel : PageModel
{
    public int Code { get; private set; }
    public string Heading { get; private set; } = "";
    public string Message { get; private set; } = "";

    public void OnGet(int code)
    {
        Code = code;
        (Heading, Message) = code switch
        {
            403 => ("You don't have access", "This project is private to its members. Ask the project lead for an invitation."),
            404 => ("Nothing here", "We couldn't find that page, project or issue."),
            429 => ("Slow down", "Too many attempts. Wait a minute and try again."),
            500 => ("Something went wrong", "An unexpected error occurred. Please try again."),
            _ => ("Request failed", "The request could not be completed."),
        };
    }
}
