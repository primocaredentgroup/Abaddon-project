import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { NextResponse } from "next/server";

const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST() {
  try {
    const result = await client.mutation(api.ticketStatuses.initializeDefaultStatuses, {});
    return NextResponse.json({ 
      success: true, 
      ...result 
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: "Usa il metodo POST per eseguire la migration degli stati ticket" 
  });
}


