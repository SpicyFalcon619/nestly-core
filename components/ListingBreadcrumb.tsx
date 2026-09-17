'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export const LAST_RESULTS_KEY = 'nestly:lastListingsSearch';

export default function ListingBreadcrumb({ zoneId, zoneName, title }: { zoneId?: number; zoneName: string | null; title: string }) {
  const [resultsHref, setResultsHref] = useState('/listings');

  // Arriving from a filtered /listings page, "Listings" should go back to those
  // filters rather than dumping the user on an unfiltered first page. The results
  // page records its query in sessionStorage — document.referrer can't be used,
  // since it isn't updated by client-side navigation.
  useEffect(() => {
    try {
      const search = sessionStorage.getItem(LAST_RESULTS_KEY);
      if (search) setResultsHref(`/listings${search}`);
    } catch {
      // storage unavailable
    }
  }, []);

  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <Link href={resultsHref}>{resultsHref === '/listings' ? 'Listings' : 'Back to results'}</Link>
      {zoneName && zoneId && (
        <>
          <ChevronRight size={13} aria-hidden="true" />
          <Link href={`/listings?zone=${zoneId}`}>{zoneName}</Link>
        </>
      )}
      <ChevronRight size={13} aria-hidden="true" />
      <span aria-current="page">{title}</span>
    </nav>
  );
}
