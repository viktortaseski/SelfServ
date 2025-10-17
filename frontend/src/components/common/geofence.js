const RESTAURANT_COORDS = { lat: 45.546492, lng: 13.729156 };
const DELIVERY_RADIUS_METERS = 100;
const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

const deg2rad = (deg) => deg * (Math.PI / 180);

const distanceInMeters = (a, b) => {
    const R = 6371000;
    const dLat = deg2rad(b.lat - a.lat);
    const dLng = deg2rad(b.lng - a.lng);
    const lat1 = deg2rad(a.lat);
    const lat2 = deg2rad(b.lat);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h =
        sinLat * sinLat +
        sinLng * sinLng * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const getPosition = () =>
    new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, GEO_OPTIONS)
    );

export async function verifyWithinRestaurant() {
    if (!navigator.geolocation) {
        alert("Location services are required to place an order.");
        return false;
    }

    try {
        const position = await getPosition();
        const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
        };
        const distance = distanceInMeters(userPos, RESTAURANT_COORDS);
        if (distance > DELIVERY_RADIUS_METERS) {
            alert("You must be at the restaurant to place an order.");
            return false;
        }
        return true;
    } catch (err) {
        console.error("Geolocation error:", err);
        alert("We couldn't verify your location. Please enable location access and try again.");
        return false;
    }
}

