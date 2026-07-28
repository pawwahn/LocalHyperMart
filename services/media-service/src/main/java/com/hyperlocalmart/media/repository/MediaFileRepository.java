package com.hyperlocalmart.media.repository;

import com.hyperlocalmart.media.entity.MediaFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface MediaFileRepository extends JpaRepository<MediaFile, UUID> {
}
