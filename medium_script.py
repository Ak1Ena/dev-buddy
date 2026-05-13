import math

def calculate_stats(numbers):
    """
    Calculates basic statistics for a list of numbers.
    """
    if not numbers:
        return None
    
    # Calculate sum
    total_sum = sum(numbers)
    
    # Calculate mean
    count = len(numbers)
    mean = total_sum / count
    
    # Calculate variance and standard deviation
    squared_diff_sum = 0
    for n in numbers:
        diff = n - mean
        squared_diff = diff ** 2
        squared_diff_sum += squared_diff
        
    variance = squared_diff_sum / count
    std_dev = math.sqrt(variance)
    
    return {
        "mean": mean,
        "variance": variance,
        "std_dev": std_dev,
        "count": count
    }

def process_data_points(data):
    results = []
    for group_name, points in data.items():
        print(f"Processing group: {group_name}")
        stats = calculate_stats(points)
        if stats:
            results.append((group_name, stats))
        else:
            print(f"Warning: No data for group {group_name}")
    return results

# Sample data
raw_data = {
    "group_a": [10, 12, 23, 11, 15],
    "group_b": [5, 8, 2, 1, 9],
    "group_c": []
}

final_results = process_data_points(raw_data)

for name, res in final_results:
    print(f"Stats for {name}: {res}")
