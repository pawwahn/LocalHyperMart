package com.hyperlocalmart.town.service;

import com.hyperlocalmart.town.entity.PlatformSetting;
import com.hyperlocalmart.town.legal.DefaultLegalDocuments;
import com.hyperlocalmart.town.repository.MembershipPackRevisionRepository;
import com.hyperlocalmart.town.repository.PlatformSettingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlatformSettingsServiceTest {

    @Mock
    private PlatformSettingRepository platformSettingRepository;
    @Mock
    private MembershipPackRevisionRepository membershipPackRevisionRepository;
    @Mock
    private AdminAuditor adminAuditService;

    private PlatformSettingsService service;

    @BeforeEach
    void setUp() {
        service = new PlatformSettingsService(
                platformSettingRepository, membershipPackRevisionRepository, adminAuditService);
    }

    @Test
    void publicSettings_includeDefaultLegalCopy() {
        when(platformSettingRepository.findBySettingKey(PlatformSettingsService.KEY_PLATFORM))
                .thenReturn(Optional.empty());

        Map<String, Object> pub = service.getPublicSettings();

        assertThat(pub.get("termsText")).asString().contains("WALLET / STORE CREDIT");
        assertThat(pub.get("privacyText")).asString().contains("DATA WE COLLECT");
        assertThat(pub.get("refundText")).asString().contains("FREE DELIVERY PACKS");
        assertThat(pub.get("legalVersion")).isEqualTo(1);
    }

    @Test
    void patch_bumpsVersionWhenTermsChange() {
        when(platformSettingRepository.findBySettingKey(PlatformSettingsService.KEY_PLATFORM))
                .thenReturn(Optional.empty());
        when(platformSettingRepository.save(org.mockito.ArgumentMatchers.any(PlatformSetting.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        Map<String, Object> patch = new LinkedHashMap<>();
        patch.put("termsText", DefaultLegalDocuments.terms() + "\n\nExtra clause for testers.");
        Map<String, Object> saved = service.patchSettings(patch);

        assertThat(saved.get("legalVersion")).isEqualTo(2);
        assertThat(saved.get("legalUpdatedAt")).asString().isNotBlank();
        ArgumentCaptor<PlatformSetting> captor = ArgumentCaptor.forClass(PlatformSetting.class);
        verify(platformSettingRepository).save(captor.capture());
        assertThat(captor.getValue().getSettingValue().get("termsText").toString())
                .contains("Extra clause for testers");
    }

    @Test
    void patch_recordsPackHistoryWhenPricesChange() {
        when(platformSettingRepository.findBySettingKey(PlatformSettingsService.KEY_PLATFORM))
                .thenReturn(Optional.empty());
        when(platformSettingRepository.save(org.mockito.ArgumentMatchers.any(PlatformSetting.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(membershipPackRevisionRepository.maxVersionNo()).thenReturn(0);

        Map<String, Object> patch = new LinkedHashMap<>();
        patch.put("membershipEnabled", true);
        patch.put("membershipQuarterlyPrice", 1999);
        patch.put("membershipQuarterlyCredits", 15);
        service.patchSettings(patch);

        ArgumentCaptor<com.hyperlocalmart.town.entity.MembershipPackRevision> captor =
                ArgumentCaptor.forClass(com.hyperlocalmart.town.entity.MembershipPackRevision.class);
        verify(membershipPackRevisionRepository).save(captor.capture());
        assertThat(captor.getValue().getVersionNo()).isEqualTo(1);
        assertThat(captor.getValue().isSellingEnabled()).isTrue();
        assertThat(captor.getValue().getChangeSummary()).contains("3 months");
    }

    @Test
    void patch_rejectsEmptyTerms() {
        when(platformSettingRepository.findBySettingKey(PlatformSettingsService.KEY_PLATFORM))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.patchSettings(Map.of("termsText", "  ")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("termsText");
    }
}
