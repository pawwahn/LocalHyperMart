package com.hyperlocalmart.town.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.town.dto.response.GeoCountryResponse;
import com.hyperlocalmart.town.dto.response.GeoStateResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Static geo catalog for town onboarding. Expand countries/states here as markets open.
 */
@Service
public class GeoCatalogService {

    private static final List<GeoCountryResponse> COUNTRIES = List.of(
            country("IN", "India", List.of(
                    state("AN", "Andaman and Nicobar Islands"),
                    state("AP", "Andhra Pradesh"),
                    state("AR", "Arunachal Pradesh"),
                    state("AS", "Assam"),
                    state("BR", "Bihar"),
                    state("CH", "Chandigarh"),
                    state("CT", "Chhattisgarh"),
                    state("DH", "Dadra and Nagar Haveli and Daman and Diu"),
                    state("DL", "Delhi"),
                    state("GA", "Goa"),
                    state("GJ", "Gujarat"),
                    state("HR", "Haryana"),
                    state("HP", "Himachal Pradesh"),
                    state("JK", "Jammu and Kashmir"),
                    state("JH", "Jharkhand"),
                    state("KA", "Karnataka"),
                    state("KL", "Kerala"),
                    state("LA", "Ladakh"),
                    state("LD", "Lakshadweep"),
                    state("MP", "Madhya Pradesh"),
                    state("MH", "Maharashtra"),
                    state("MN", "Manipur"),
                    state("ML", "Meghalaya"),
                    state("MZ", "Mizoram"),
                    state("NL", "Nagaland"),
                    state("OD", "Odisha"),
                    state("PY", "Puducherry"),
                    state("PB", "Punjab"),
                    state("RJ", "Rajasthan"),
                    state("SK", "Sikkim"),
                    state("TN", "Tamil Nadu"),
                    state("TS", "Telangana"),
                    state("TR", "Tripura"),
                    state("UP", "Uttar Pradesh"),
                    state("UK", "Uttarakhand"),
                    state("WB", "West Bengal")
            )),
            country("AE", "United Arab Emirates", List.of(
                    state("AZ", "Abu Dhabi"),
                    state("AJ", "Ajman"),
                    state("DU", "Dubai"),
                    state("FU", "Fujairah"),
                    state("RK", "Ras Al Khaimah"),
                    state("SH", "Sharjah"),
                    state("UQ", "Umm Al Quwain")
            )),
            country("SG", "Singapore", List.of(
                    state("SG", "Singapore")
            )),
            country("GB", "United Kingdom", List.of(
                    state("ENG", "England"),
                    state("SCT", "Scotland"),
                    state("WLS", "Wales"),
                    state("NIR", "Northern Ireland")
            )),
            country("US", "United States", List.of(
                    state("AL", "Alabama"),
                    state("AK", "Alaska"),
                    state("AZ", "Arizona"),
                    state("AR", "Arkansas"),
                    state("CA", "California"),
                    state("CO", "Colorado"),
                    state("CT", "Connecticut"),
                    state("DE", "Delaware"),
                    state("FL", "Florida"),
                    state("GA", "Georgia"),
                    state("HI", "Hawaii"),
                    state("ID", "Idaho"),
                    state("IL", "Illinois"),
                    state("IN", "Indiana"),
                    state("IA", "Iowa"),
                    state("KS", "Kansas"),
                    state("KY", "Kentucky"),
                    state("LA", "Louisiana"),
                    state("ME", "Maine"),
                    state("MD", "Maryland"),
                    state("MA", "Massachusetts"),
                    state("MI", "Michigan"),
                    state("MN", "Minnesota"),
                    state("MS", "Mississippi"),
                    state("MO", "Missouri"),
                    state("MT", "Montana"),
                    state("NE", "Nebraska"),
                    state("NV", "Nevada"),
                    state("NH", "New Hampshire"),
                    state("NJ", "New Jersey"),
                    state("NM", "New Mexico"),
                    state("NY", "New York"),
                    state("NC", "North Carolina"),
                    state("ND", "North Dakota"),
                    state("OH", "Ohio"),
                    state("OK", "Oklahoma"),
                    state("OR", "Oregon"),
                    state("PA", "Pennsylvania"),
                    state("RI", "Rhode Island"),
                    state("SC", "South Carolina"),
                    state("SD", "South Dakota"),
                    state("TN", "Tennessee"),
                    state("TX", "Texas"),
                    state("UT", "Utah"),
                    state("VT", "Vermont"),
                    state("VA", "Virginia"),
                    state("WA", "Washington"),
                    state("WV", "West Virginia"),
                    state("WI", "Wisconsin"),
                    state("WY", "Wyoming"),
                    state("DC", "District of Columbia")
            ))
    );

    public List<GeoCountryResponse> listCountries() {
        return COUNTRIES;
    }

    public GeoCountryResponse requireCountry(String countryCode) {
        String code = normalize(countryCode);
        return findCountry(code)
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Unsupported country: " + countryCode));
    }

    public GeoStateResponse requireState(String countryCode, String stateCode) {
        GeoCountryResponse country = requireCountry(countryCode);
        String code = normalize(stateCode);
        return country.getStates().stream()
                .filter(s -> s.getCode().equalsIgnoreCase(code))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Unsupported state/region for " + country.getName() + ": " + stateCode));
    }

    public Optional<GeoCountryResponse> findCountry(String countryCode) {
        String code = normalize(countryCode);
        return COUNTRIES.stream()
                .filter(c -> c.getCode().equalsIgnoreCase(code))
                .findFirst();
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }

    private static GeoCountryResponse country(String code, String name, List<GeoStateResponse> states) {
        return GeoCountryResponse.builder().code(code).name(name).states(states).build();
    }

    private static GeoStateResponse state(String code, String name) {
        return GeoStateResponse.builder().code(code).name(name).build();
    }
}
