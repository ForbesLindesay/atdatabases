export const GA_TRACKING_ID = `UA-31798041-12`;

// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const pageView = (url: string) => {
  console.log(`pageView`, url);
  (window as any).gtag('event', 'page_view', {
    page_location: `${location.origin}${url}`,
    page_path: url,
    send_to: GA_TRACKING_ID,
  });
};

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const event = ({action, category, label, value}: any) => {
  (window as any).gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  });
};
