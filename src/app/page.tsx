import { redirect } from "next/navigation";

import { getServerAuthSession } from "@/lib/auth/session";

const Page = async () => {
  const session = await getServerAuthSession();

  redirect(session ? "/dashboard" : "/login");
};

export default Page;

