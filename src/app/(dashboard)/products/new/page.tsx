import type { Metadata } from "next";
import { ProductCreate } from "./product-create";

export const metadata: Metadata = { title: "New product" };

export default function NewProductPage() {
  return <ProductCreate />;
}
