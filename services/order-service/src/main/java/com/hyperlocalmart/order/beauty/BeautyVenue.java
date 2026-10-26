package com.hyperlocalmart.order.beauty;

public enum BeautyVenue {
    AT_HOME,
    AT_STUDIO;

    public String label() {
        return switch (this) {
            case AT_HOME -> "At your home";
            case AT_STUDIO -> "At the studio";
        };
    }
}
