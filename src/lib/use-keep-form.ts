"use client";

import { startTransition, type FormEvent } from "react";

/**
 * React resets a <form action={…}> after every submission, which wipes what the
 * user typed (and select boxes) when the server returns validation errors.
 * Submitting through onSubmit keeps the fields as they are.
 */
export function useKeepForm(formAction: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(fd));
  };
}
