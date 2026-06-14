package geospatial

// Point represents a lat/lon coordinate
type Point struct {
	Lat float64
	Lon float64
}

// IsPointInPolygon uses ray-casting algorithm to check if a point is inside a polygon
// coordinates are [][lat, lon] pairs
func IsPointInPolygon(lat, lon float64, coordinates [][]float64) bool {
	n := len(coordinates)
	if n < 3 {
		return false
	}

	inside := false
	j := n - 1

	for i := 0; i < n; i++ {
		xi, yi := coordinates[i][1], coordinates[i][0] // lon, lat
		xj, yj := coordinates[j][1], coordinates[j][0]

		if ((yi > lon) != (yj > lon)) &&
			(lat < (xj-xi)*(lon-yi)/(yj-yi)+xi) {
			inside = !inside
		}
		j = i
	}

	return inside
}
