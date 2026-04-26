package database

import "context"

func (db *DB) AddFavourite(userID, symbol string) error {
	_, err := db.Pool.Exec(
		context.Background(),
		`INSERT INTO favourites (user_id, symbol) VALUES ($1, $2)
		 ON CONFLICT (user_id, symbol) DO NOTHING`,
		userID, symbol,
	)
	return err
}

func (db *DB) RemoveFavourite(userID, symbol string) error {
	_, err := db.Pool.Exec(
		context.Background(),
		`DELETE FROM favourites WHERE user_id = $1 AND symbol = $2`,
		userID, symbol,
	)
	return err
}

func (db *DB) GetFavourites(userID string) ([]string, error) {
	rows, err := db.Pool.Query(
		context.Background(),
		`SELECT symbol FROM favourites WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	favourites := []string{}
	for rows.Next() {
		var symbol string
		if err := rows.Scan(&symbol); err != nil {
			return nil, err
		}
		favourites = append(favourites, symbol)
	}
	return favourites, nil
}
