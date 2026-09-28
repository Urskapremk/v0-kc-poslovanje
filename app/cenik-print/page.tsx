"use client";

import React from "react";
import { getProducts } from "@/app/actions/admin";

// Categories to exclude ("Prehrana" was renamed to "Ice cream and sorbets";
// it stays off the printed price list, as before the rename)
const EXCLUDED_CATEGORIES = ["Hrana", "Wellness", "Razno", "Ice cream and sorbets"];

// Format Ariary with spaces
function formatAr(amount: number): string {
  return amount.toLocaleString("sl-SI").replace(/,/g, " ") + " Ar";
}

export default function CenikPrintPage() {
  const [products, setProducts] = React.useState<{ id: string; name: string; category: string; priceAr: number; active: boolean }[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getProducts().then((data) => {
      // Filter out excluded categories and inactive products
      const filtered = data.filter(
        (p) => p.active && !EXCLUDED_CATEGORIES.includes(p.category)
      );
      setProducts(filtered);
      setLoading(false);
    });
  }, []);

  // Group products by category
  const groupedProducts = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = [];
    }
    acc[product.category].push(product);
    return acc;
  }, {} as Record<string, typeof products>);

  // Sort categories alphabetically
  const sortedCategories = Object.keys(groupedProducts).sort();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Print button */}
      <div className="no-print fixed top-4 right-4 z-50">
        <button
          onClick={() => window.print()}
          className="px-6 py-3 bg-[#576f59] text-white rounded-lg shadow-lg hover:bg-[#485b4a] transition-colors font-medium"
        >
          Print Menu
        </button>
      </div>

      {/* Content */}
      <div className="max-w-[210mm] mx-auto px-8 py-10">
        {/* Header with logo */}
        <div className="text-center mb-10">
          <img
            src="/komba-logo-print.png"
            alt="Komba Cabana"
            className="h-28 mx-auto mb-4"
          />
          <h1 className="text-3xl font-light text-[#5c4c38] tracking-wide mt-6">
            DRINKS MENU
          </h1>
          <div className="w-24 h-0.5 bg-[#8fa992] mx-auto mt-3"></div>
        </div>

        {/* Price list */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-8">
          {sortedCategories.map((category) => (
            <div key={category} className="break-inside-avoid">
              {/* Category header */}
              <div className="border-b-2 border-[#8fa992] pb-1 mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-widest text-[#5c4c38]">
                  {category}
                </h2>
              </div>

              {/* Products */}
              <div className="space-y-1.5">
                {groupedProducts[category]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((product) => (
                    <div
                      key={product.id}
                      className="flex justify-between items-baseline text-sm"
                    >
                      <span className="text-[#3a352f] flex-1 pr-2">
                        {product.name}
                      </span>
                      <span className="text-[#5c4c38] font-medium whitespace-nowrap">
                        {formatAr(product.priceAr)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400 italic">
            Prices are indicative and may change without prior notice.
          </p>
        </div>
      </div>
    </div>
  );
}
