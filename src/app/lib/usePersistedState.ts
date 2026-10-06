"use client";

import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

type PersistedStateOptions<T> = {
  validate?: (value: unknown) => value is T;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
};

const defaultSerialize = JSON.stringify;
const defaultDeserialize = <T,>(value: string): T => JSON.parse(value) as T;

function resolveInitialValue<T>(initialValue: T | (() => T)): T {
  return typeof initialValue === "function" ? (initialValue as () => T)() : initialValue;
}

function readPersistedValue<T>(
  key: string,
  initialValue: T | (() => T),
  options: PersistedStateOptions<T>
): T {
  const fallback = resolveInitialValue(initialValue);
  if (globalThis.window === undefined) {
    return fallback;
  }

  try {
    const storedValue = globalThis.window.localStorage.getItem(key);
    if (storedValue === null) {
      return fallback;
    }

    const deserialize = options.deserialize ?? ((value: string) => JSON.parse(value) as T);
    const parsed = deserialize(storedValue);
    if (options.validate && !options.validate(parsed)) {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

export function usePersistedState<T>(
  key: string,
  initialValue: T | (() => T),
  options: PersistedStateOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>] {
  const validate = options.validate;
  const serialize = options.serialize ?? defaultSerialize;
  const deserialize = options.deserialize ?? defaultDeserialize<T>;
  const resolvedOptions = { validate, serialize, deserialize };
  const [state, setState] = useState<T>(() => resolveInitialValue(initialValue));
  const activeKeyRef = useRef(key);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    const shouldReadPersistedValue = activeKeyRef.current !== key || !hasHydratedRef.current;

    if (!shouldReadPersistedValue) {
      return;
    }

    activeKeyRef.current = key;
    hasHydratedRef.current = true;
    setState(readPersistedValue(key, initialValue, resolvedOptions));
  }, [deserialize, initialValue, key, serialize, validate]);

  useEffect(() => {
    if (globalThis.window === undefined || activeKeyRef.current !== key || !hasHydratedRef.current) {
      return;
    }

    try {
      globalThis.window.localStorage.setItem(key, serialize(state));
    } catch {
      // Ignore storage quota and serialization errors.
    }
  }, [key, serialize, state]);

  return [state, setState];
}
