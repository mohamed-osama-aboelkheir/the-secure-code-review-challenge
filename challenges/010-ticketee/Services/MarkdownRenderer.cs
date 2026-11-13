using Ganss.Xss;
using Markdig;
using Microsoft.AspNetCore.Html;

namespace Ticketee.Services;

public class MarkdownRenderer
{
    private readonly MarkdownPipeline _pipeline = new MarkdownPipelineBuilder()
        .DisableHtml()
        .UsePipeTables()
        .UseTaskLists()
        .UseEmphasisExtras()
        .UseAutoLinks()
        .UseSoftlineBreakAsHardlineBreak()
        .Build();

    private readonly HtmlSanitizer _sanitizer;

    public MarkdownRenderer()
    {
        _sanitizer = new HtmlSanitizer();
        _sanitizer.AllowedSchemes.Clear();
        _sanitizer.AllowedSchemes.Add("http");
        _sanitizer.AllowedSchemes.Add("https");
        _sanitizer.AllowedSchemes.Add("mailto");
        _sanitizer.AllowedAttributes.Add("checked");
        _sanitizer.AllowedAttributes.Add("disabled");
        _sanitizer.AllowedAttributes.Remove("style");
        _sanitizer.AllowedCssProperties.Clear();
        _sanitizer.PostProcessNode += (_, e) =>
        {
            if (e.Node is AngleSharp.Dom.IElement { TagName: "A" } link)
            {
                link.SetAttribute("rel", "noopener noreferrer nofollow");
                link.SetAttribute("target", "_blank");
            }
        };
    }

    public IHtmlContent Render(string? markdown)
    {
        if (string.IsNullOrWhiteSpace(markdown)) return HtmlString.Empty;
        var html = Markdown.ToHtml(markdown, _pipeline);
        return new HtmlString(_sanitizer.Sanitize(html));
    }
}
