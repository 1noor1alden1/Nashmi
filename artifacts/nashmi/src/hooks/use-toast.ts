import { useState, useEffect } from "react";

type ToastProps = {
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
};

let toastCallback: ((toast: ToastProps) => void) | null = null;

export function toast(props: ToastProps) {
  if (toastCallback) {
    toastCallback(props);
  }
}

export function useToast() {
  const [toasts, setToasts] = useState<(ToastProps & { id: string })[]>([]);

  useEffect(() => {
    toastCallback = (props: ToastProps) => {
      const id = Math.random().toString(36).substr(2, 9);
      setToasts((prev) => [...prev, { ...props, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    };
    return () => {
      toastCallback = null;
    };
  }, []);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, dismiss };
}
