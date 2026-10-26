package com.hyperlocalmart.order.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Table(name = "beauty_day_seq")
@Getter
@Setter
public class BeautyDaySeq {

    @Id
    private LocalDate day;

    @Column(name = "last_no", nullable = false)
    private int lastNo;
}
