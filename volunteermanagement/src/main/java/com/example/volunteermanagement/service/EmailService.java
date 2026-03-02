package com.example.volunteermanagement.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String senderEmail;

    // Az @Async biztosítja, hogy az e-mail küldés a háttérben fusson, és ne akassza meg a felületet!
    @Async
    public void sendBulkEmailBcc(List<String> bccEmails, String subject, String messageText) {
        if (bccEmails == null || bccEmails.isEmpty()) return;

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(senderEmail);
            // Titkos másolat (BCC), hogy ne lássák egymás e-mail címét
            helper.setBcc(bccEmails.toArray(new String[0]));
            helper.setSubject(subject);
            helper.setText(messageText, false); // false = sima szöveg, nem HTML

            mailSender.send(message);
            System.out.println("✅ E-mail sikeresen kiküldve " + bccEmails.size() + " címzettnek.");

        } catch (MessagingException e) {
            System.err.println("❌ Hiba az e-mail küldésekor: " + e.getMessage());
            throw new RuntimeException("Nem sikerült elküldeni az e-maileket.");
        }
    }
}