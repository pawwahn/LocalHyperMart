package com.hyperlocalmart.payment.client;

import java.util.HashMap;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Reuses a result only on the thread that called {@link #begin()}, for the accounts scan.
 * Other screens always load fresh.
 */
final class ShortCallCache<T> {

    private final ThreadLocal<Map<String, T>> replay = new ThreadLocal<>();

    void begin() {
        replay.set(new HashMap<>());
    }

    void end() {
        replay.remove();
    }

    T get(String key, Supplier<T> loader) {
        Map<String, T> box = replay.get();
        if (box != null && box.containsKey(key)) {
            return box.get(key);
        }
        T value = loader.get();
        if (box != null) {
            box.put(key, value);
        }
        return value;
    }
}
