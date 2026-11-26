import { Service } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';

/** Notifications, shown by the <hlm-toaster> in the app shell. */
@Service()
export class Toasts {
  success(message: string) {
    toast.success(message);
  }

  error(message: string) {
    toast.error(message);
  }
}
