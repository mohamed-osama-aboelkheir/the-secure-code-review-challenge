package com.projecthub.service;

import com.projecthub.model.Project;
import freemarker.template.Configuration;
import freemarker.template.Template;
import freemarker.template.TemplateException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.view.freemarker.FreeMarkerConfig;

import java.io.IOException;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.Map;

@Service
public class ReportService {

    private final Configuration freemarker;

    public ReportService(FreeMarkerConfig freeMarkerConfig) {
        this.freemarker = freeMarkerConfig.getConfiguration();
    }

    public String render(String templateSource, Project project) {
        try {
            Template template = new Template("report", new StringReader(templateSource), freemarker);
            StringWriter out = new StringWriter();
            template.process(Map.of("project", project), out);
            return out.toString();
        } catch (IOException | TemplateException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Report template could not be rendered");
        }
    }
}
