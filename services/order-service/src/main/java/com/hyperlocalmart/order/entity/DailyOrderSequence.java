package com.hyperlocalmart.order.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "daily_order_sequences")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyOrderSequence {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "order_date", nullable = false)
    private LocalDate orderDate;

    @Column(name = "last_sequence", nullable = false)
    @Builder.Default
    private int lastSequence = 0;
}
