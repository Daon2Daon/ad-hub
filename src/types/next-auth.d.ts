import type { Role, UserStatus } from "@prisma/client";
import type { DefaultSession } from "next-auth";

import type { UserAccessProfile } from "@/types/auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      loginId: string;
      role: Role;
      status: UserStatus;
    };
    accessProfile: UserAccessProfile;
  }

  interface User {
    loginId: string;
    role: Role;
    status: UserStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    loginId?: string;
    role?: Role;
    status?: UserStatus;
    accessProfile?: UserAccessProfile;
  }
}
