import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

/**
 * Favicon. This previously rendered "₿" — the Bitcoin symbol — on a precious
 * metals site.
 */
export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 20,
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #d6a93e, #ad7019)',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000',
                    borderRadius: '22%',
                }}
            >
                Au
            </div>
        ),
        { ...size }
    )
}
