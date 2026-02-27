package com.example.volunteermanagement.dto;

import com.example.volunteermanagement.model.QuestionType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record EventQuestionDTO(
        Long id,

        @NotBlank(message = "A kérdés szövege nem lehet üres")
        String questionText,

        @NotNull(message = "A kérdés típusa kötelező")
        QuestionType questionType,

        String options, // Ide jönnek a válaszlehetőségek vesszővel elválasztva

        boolean isRequired
) {}