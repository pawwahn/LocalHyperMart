package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.dto.request.ApplyListingRatingRequest;
import com.hyperlocalmart.catalog.dto.response.ListingRatingSummaryResponse;
import com.hyperlocalmart.catalog.entity.VendorListing;
import com.hyperlocalmart.catalog.repository.VendorListingRepository;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ListingRatingService {

    private final VendorListingRepository vendorListingRepository;

    @Transactional
    public ListingRatingSummaryResponse applyRating(UUID listingId, ApplyListingRatingRequest request) {
        VendorListing listing = vendorListingRepository.findById(listingId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Listing not found"));

        int stars = request.getStars();
        BigDecimal avg = listing.getAvgRating() == null ? BigDecimal.ZERO : listing.getAvgRating();
        int count = Math.max(0, listing.getRatingCount());

        if (request.getPreviousStars() == null) {
            BigDecimal total = avg.multiply(BigDecimal.valueOf(count)).add(BigDecimal.valueOf(stars));
            count = count + 1;
            avg = total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
        } else {
            if (count <= 0) {
                count = 1;
                avg = BigDecimal.valueOf(stars).setScale(2, RoundingMode.HALF_UP);
            } else {
                BigDecimal total = avg.multiply(BigDecimal.valueOf(count))
                        .subtract(BigDecimal.valueOf(request.getPreviousStars()))
                        .add(BigDecimal.valueOf(stars));
                avg = total.divide(BigDecimal.valueOf(count), 2, RoundingMode.HALF_UP);
            }
        }

        if (avg.compareTo(BigDecimal.ONE) < 0) {
            avg = BigDecimal.ONE.setScale(2, RoundingMode.HALF_UP);
        }
        if (avg.compareTo(BigDecimal.valueOf(5)) > 0) {
            avg = BigDecimal.valueOf(5).setScale(2, RoundingMode.HALF_UP);
        }

        listing.setAvgRating(avg);
        listing.setRatingCount(count);
        vendorListingRepository.save(listing);

        return ListingRatingSummaryResponse.builder()
                .listingId(listing.getId())
                .avgRating(listing.getAvgRating())
                .ratingCount(listing.getRatingCount())
                .build();
    }
}
