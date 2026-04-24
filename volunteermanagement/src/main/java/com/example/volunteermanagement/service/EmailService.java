package com.example.volunteermanagement.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.UnsupportedEncodingException;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String senderEmail;

    @Async
    public void sendBulkEmailBcc(List<String> bccEmails, String subject, String messageText, String orgName, String orgEmail, java.util.Map<String, byte[]> attachments) {
        if (bccEmails == null || bccEmails.isEmpty()) return;

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(senderEmail, orgName);

            if (orgEmail != null && !orgEmail.trim().isEmpty()) {
                helper.setReplyTo(orgEmail, orgName);
            }

            helper.setBcc(bccEmails.toArray(new String[0]));
            helper.setSubject(subject);
            helper.setText(messageText, true);

            // ---> ÚJ LOGIKA: Csatolmányok készítése a memóriából (byte tömbből) <---
            if (attachments != null && !attachments.isEmpty()) {
                for (java.util.Map.Entry<String, byte[]> entry : attachments.entrySet()) {
                    helper.addAttachment(entry.getKey(), new ByteArrayResource(entry.getValue()));
                }
            }

            mailSender.send(message);
            System.out.println("✅ E-mail sikeresen kiküldve " + bccEmails.size() + " címzettnek a(z) " + orgName + " nevében.");

        } catch (jakarta.mail.MessagingException | java.io.UnsupportedEncodingException e) {
            System.err.println("❌ Hiba az e-mail küldésekor: " + e.getMessage());
            throw new RuntimeException("Nem sikerült elküldeni az e-maileket.");
        }
    }
}