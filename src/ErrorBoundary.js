import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // อัปเดต state เพื่อให้ render fallback UI ในครั้งถัดไป
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // คุณสามารถ log ข้อผิดพลาดไปยังบริการรายงานข้อผิดพลาดได้ที่นี่
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // คุณสามารถ render UI สำรองใดๆ ก็ได้
      return (
        <div style={{ padding: '20px', border: '1px solid red', backgroundColor: '#ffe6e6', color: 'red' }}>
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo.componentStack}
          </details>
          <p>Please try refreshing the page or contact support.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;