package com.example.volunteermanagement.service;

import com.example.volunteermanagement.dto.VolunteerProfileDTO;
import com.example.volunteermanagement.model.User;
import com.example.volunteermanagement.model.VolunteerProfile;
import com.example.volunteermanagement.repository.UserRepository;
import com.example.volunteermanagement.repository.VolunteerProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class VolunteerService {

    private final VolunteerProfileRepository profileRepository;
    private final UserRepository userRepository;

    public VolunteerProfileDTO getMyProfile(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Felhasználó nem található"));

        VolunteerProfile profile = profileRepository.findByUser(user)
                // Ha nincs profilja, üreset adunk vissza (vagy dobhatunk hibát is)
                .orElse(VolunteerProfile.builder().user(user).build());

        return mapToDTO(profile);
    }

    @Transactional
    public VolunteerProfileDTO updateMyProfile(String email, VolunteerProfileDTO dto) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("Felhasználó nem található"));

        VolunteerProfile profile = profileRepository.findByUser(user)
                .orElse(VolunteerProfile.builder().user(user).build());

        profile.setFullName(dto.fullName());
        profile.setPhoneNumber(dto.phoneNumber());
        profile.setBio(dto.bio());
        profile.setSkills(dto.skills());

        VolunteerProfile saved = profileRepository.save(profile);
        return mapToDTO(saved);
    }

    // Kézi konverzió (egyszerűbb most, mint a MapStruct beüzemelése)
    private VolunteerProfileDTO mapToDTO(VolunteerProfile p) {
        return new VolunteerProfileDTO(
                p.getFullName(),
                p.getPhoneNumber(),
                p.getBio(),
                p.getSkills()
        );
    }
}